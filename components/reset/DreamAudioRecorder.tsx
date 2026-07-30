"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createOfflineEntityId,
  saveOfflineAudio,
} from "@/lib/offlineStore";
import { createClient } from "@/utils/supabase/client";

export type AudioCaptureState = {
  pendingUpload: boolean;
  blobKey: string | null;
  storagePath: string;
  contentType: string;
};

type DreamAudioRecorderProps = {
  onAudioUploaded: (
    audioPath: string,
    previewUrl: string,
    captureState?: AudioCaptureState
  ) => void;
  savedDreamId: string | null;
  savedAudioPath: string | null;
  isTranscribing: boolean;
  onTranscribe?: () => void | Promise<void>;
  contextLabel?: "dream" | "shadow";
};

const MAX_AUDIO_BYTES =
  25 * 1024 * 1024;

export function DreamAudioRecorder({
  onAudioUploaded,
  savedDreamId,
  savedAudioPath,
  isTranscribing,
  onTranscribe,
  contextLabel = "dream",
}: DreamAudioRecorderProps) {
  const supabase = createClient();
  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);
  const chunksRef =
    useRef<BlobPart[]>([]);
  const previewUrlRef =
    useRef<string | null>(null);

  const [
    isRecording,
    setIsRecording,
  ] = useState(false);
  const [
    isUploading,
    setIsUploading,
  ] = useState(false);
  const [
    previewUrl,
    setPreviewUrl,
  ] = useState<string | null>(
    null
  );
  const [message, setMessage] =
    useState<string | null>(
      null
    );
  const [isOnline, setIsOnline] =
    useState(true);

  const supportsTranscription =
    typeof onTranscribe ===
    "function";
  const canTranscribe =
    Boolean(
      supportsTranscription &&
        savedDreamId &&
        savedAudioPath &&
        isOnline
    );

  useEffect(() => {
    const updateConnection =
      () =>
        setIsOnline(
          navigator.onLine
        );

    updateConnection();
    window.addEventListener(
      "online",
      updateConnection
    );
    window.addEventListener(
      "offline",
      updateConnection
    );

    return () => {
      window.removeEventListener(
        "online",
        updateConnection
      );
      window.removeEventListener(
        "offline",
        updateConnection
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      if (
        previewUrlRef.current
      ) {
        URL.revokeObjectURL(
          previewUrlRef.current
        );
      }

      const recorder =
        mediaRecorderRef.current;

      if (
        recorder &&
        recorder.state !==
          "inactive"
      ) {
        recorder.stop();
      }
    };
  }, []);

  async function startRecording() {
    setMessage(null);

    if (
      !navigator.mediaDevices
        ?.getUserMedia ||
      typeof MediaRecorder ===
        "undefined"
    ) {
      setMessage(
        "Audio recording is not supported in this browser."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );

      chunksRef.current = [];

      const mimeType =
        selectAudioMimeType();
      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,
              }
            )
          : new MediaRecorder(
              stream
            );

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable =
        (event) => {
          if (
            event.data.size >
            0
          ) {
            chunksRef.current.push(
              event.data
            );
          }
        };

      recorder.onerror =
        () => {
          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );
          setIsRecording(
            false
          );
          setMessage(
            "Recording failed."
          );
        };

      recorder.onstop =
        async () => {
          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          const contentType =
            recorder.mimeType ||
            mimeType ||
            "audio/webm";
          const audioBlob =
            new Blob(
              chunksRef.current,
              {
                type:
                  contentType,
              }
            );

          if (
            audioBlob.size ===
            0
          ) {
            setMessage(
              "The recording was empty."
            );
            return;
          }

          if (
            audioBlob.size >
            MAX_AUDIO_BYTES
          ) {
            setMessage(
              "Recording is too large. Keep voice entries under 25 MB."
            );
            return;
          }

          if (
            previewUrlRef.current
          ) {
            URL.revokeObjectURL(
              previewUrlRef.current
            );
          }

          const localUrl =
            URL.createObjectURL(
              audioBlob
            );
          previewUrlRef.current =
            localUrl;
          setPreviewUrl(
            localUrl
          );

          await storeOrUploadAudio(
            audioBlob,
            localUrl
          );
        };

      recorder.start(750);
      setIsRecording(true);
      setMessage(
        `Recording ${contextLabel} signal...`
      );
    } catch (error) {
      console.error(
        "Microphone access failed:",
        error
      );
      setMessage(
        "Microphone access failed."
      );
    }
  }

  function stopRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      recorder.state ===
        "inactive"
    ) {
      return;
    }

    recorder.stop();
    setIsRecording(false);
    setMessage(
      "Recording stopped. Securing audio..."
    );
  }

  async function storeOrUploadAudio(
    audioBlob: Blob,
    localPreviewUrl: string
  ) {
    setIsUploading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();
      const user =
        session?.user ?? null;

      if (sessionError || !user) {
        throw new Error(
          "A signed-in session is required to secure this recording."
        );
      }

      const captureId =
        createOfflineEntityId();
      const extension =
        getAudioExtension(
          audioBlob.type
        );
      const storagePath =
        `${user.id}/${Date.now()}-${captureId}-${contextLabel}.${extension}`;
      const blobKey =
        `audio:${captureId}`;

      await saveOfflineAudio(
        blobKey,
        audioBlob
      );

      onAudioUploaded(
        storagePath,
        localPreviewUrl,
        {
          pendingUpload: true,
          blobKey,
          storagePath,
          contentType:
            audioBlob.type ||
            "audio/webm",
        }
      );

      setMessage(
        `${capitalize(contextLabel)} audio secured on this device. Save the entry to upload it safely.`
      );
    } catch (error) {
      console.error(
        "Audio storage failed:",
        error
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "Recording could not be stored."
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="border border-[#242424] bg-[#030303] p-3">
      <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
        &gt; {contextLabel}.audio.recorder
      </p>

      <p className="terminal-muted text-xs leading-6">
        &gt; Record now. If signal is unavailable, the audio stays on this device until upload completes.
      </p>

      <div
        className={[
          "mt-3 grid gap-2",
          supportsTranscription
            ? "md:grid-cols-2"
            : "grid-cols-1",
        ].join(" ")}
      >
        {!isRecording ? (
          <button
            type="button"
            onClick={
              startRecording
            }
            disabled={
              isUploading ||
              isTranscribing
            }
            className="min-h-[64px] whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-3 text-left text-sm leading-6 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
          >
            &gt;{" "}
            {isUploading
              ? "securing_audio..."
              : "start_recording"}
          </button>
        ) : (
          <button
            type="button"
            onClick={
              stopRecording
            }
            className="min-h-[64px] border border-[#ff4d4d] bg-[#000000] px-4 py-3 text-left text-sm text-[#ff4d4d] transition hover:bg-[#050505]"
          >
            &gt; stop_recording
          </button>
        )}

        {supportsTranscription ? (
          <button
            type="button"
            onClick={() => {
              void onTranscribe?.();
            }}
            disabled={
              !canTranscribe ||
              isTranscribing ||
              isUploading
            }
            className="min-h-[64px] whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-3 text-left text-sm leading-6 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:border-[#242424] disabled:opacity-50"
          >
            &gt;{" "}
            {isTranscribing
              ? `transcribing_${contextLabel}...`
              : canTranscribe
                ? "speech_to_text"
                : isOnline
                  ? "save and sync first"
                  : "transcription needs connection"}
          </button>
        ) : null}
      </div>

      {previewUrl ? (
        <div className="mt-4">
          <p className="terminal-muted mb-2 text-xs">
            &gt; Device playback preview:
          </p>
          <audio
            controls
            src={previewUrl}
            className="w-full"
          />
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-xs text-[#ffb020]">
          &gt; {message}
        </p>
      ) : null}
    </div>
  );
}

function selectAudioMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return (
    candidates.find(
      (candidate) =>
        MediaRecorder.isTypeSupported(
          candidate
        )
    ) ?? ""
  );
}

function getAudioExtension(
  contentType: string
) {
  if (
    contentType.includes("mp4")
  ) {
    return "m4a";
  }

  if (
    contentType.includes("ogg")
  ) {
    return "ogg";
  }

  return "webm";
}

function capitalize(
  value: string
) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}
