"use client";

import { useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type DreamAudioRecorderProps = {
  onAudioUploaded: (audioPath: string, previewUrl: string) => void;
};

export function DreamAudioRecorder({
  onAudioUploaded,
}: DreamAudioRecorderProps) {
  const supabase = createClient();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function startRecording() {
    setMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: "audio/webm",
        });

        const localUrl = URL.createObjectURL(audioBlob);
        setPreviewUrl(localUrl);

        stream.getTracks().forEach((track) => track.stop());

        await uploadAudio(audioBlob, localUrl);
      };

      recorder.start();
      setIsRecording(true);
      setMessage("Recording dream signal...");
    } catch (error) {
      console.error(error);
      setMessage("Microphone access failed.");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setMessage("Recording stopped. Uploading audio...");
  }

  async function uploadAudio(audioBlob: Blob, localPreviewUrl: string) {
    setIsUploading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Upload failed: user not authenticated.");
      setIsUploading(false);
      return;
    }

    const filePath = `${user.id}/${Date.now()}-dream.webm`;

    const { error: uploadError } = await supabase.storage
      .from("dream-audio")
      .upload(filePath, audioBlob, {
        contentType: "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("Dream audio upload failed:", uploadError.message);
      setMessage(`Upload failed: ${uploadError.message}`);
      setIsUploading(false);
      return;
    }

    onAudioUploaded(filePath, localPreviewUrl);
    setMessage("Dream audio uploaded.");
    setIsUploading(false);
  }

  return (
    <div className="border border-[#242424] bg-[#030303] p-3">
      <p className="terminal-green mb-2 text-xs uppercase tracking-[0.2em]">
        &gt; dream.audio.recorder
      </p>

      <p className="terminal-muted text-xs leading-6">
        &gt; Speak messy. Details matter. Speech-to-text comes in the next
        build.
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={isUploading}
            className="min-h-[64px] whitespace-normal break-words border border-[#39ff88] bg-[#000000] px-4 py-3 text-left text-sm leading-6 text-[#39ff88] transition hover:bg-[#050505] disabled:cursor-not-allowed disabled:opacity-60"
          >
            &gt; start_recording
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="border border-[#ff4d4d] bg-[#000000] px-4 py-3 text-left text-sm text-[#ff4d4d] transition hover:bg-[#050505]"
          >
            &gt; stop_recording
          </button>
        )}

        <button
  type="button"
  disabled
  className="min-h-[64px] whitespace-normal break-words border border-[#242424] bg-[#000000] px-4 py-3 text-left text-sm leading-6 text-[#39ff88] opacity-50"
>
  &gt; save first, then transcribe
</button>
      </div>

      {previewUrl ? (
        <div className="mt-4">
          <p className="terminal-muted mb-2 text-xs">
            &gt; Local playback preview:
          </p>
          <audio controls src={previewUrl} className="w-full" />
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-xs text-[#ffb020]">&gt; {message}</p>
      ) : null}
    </div>
  );
}