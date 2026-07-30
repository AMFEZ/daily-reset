"use client";

import {
  DreamAudioRecorder,
  type AudioCaptureState,
} from "@/components/reset/DreamAudioRecorder";

export type CapturedAudioState =
  AudioCaptureState;

type ContextAudioRecorderProps = {
  onAudioUploaded: (
    path: string,
    previewUrl: string,
    captureState?: CapturedAudioState
  ) => void;
  savedDreamId?: string | null;
  savedAudioPath?: string | null;
  isTranscribing?: boolean;
  onTranscribe?: () => void | Promise<void>;
  contextLabel?: "dream" | "shadow";
};

export function ContextAudioRecorder({
  onAudioUploaded,
  savedDreamId = null,
  savedAudioPath = null,
  isTranscribing = false,
  onTranscribe,
  contextLabel = "dream",
}: ContextAudioRecorderProps) {
  return (
    <div
      className={[
        "[&>section>div:first-child]:hidden",
        "[&>section>p:first-child]:hidden",
        "[&>section]:border-0",
        "[&>section]:bg-transparent",
        "[&>section>div:last-child]:p-0",
        "[&>div>div:first-child]:hidden",
        "[&>div>p:first-child]:hidden",
        "[&>div]:border-0",
        "[&>div]:bg-transparent",
      ].join(" ")}
    >
      <DreamAudioRecorder
        onAudioUploaded={
          onAudioUploaded
        }
        savedDreamId={
          savedDreamId
        }
        savedAudioPath={
          savedAudioPath
        }
        isTranscribing={
          isTranscribing
        }
        onTranscribe={
          onTranscribe
        }
        contextLabel={
          contextLabel
        }
      />
    </div>
  );
}
