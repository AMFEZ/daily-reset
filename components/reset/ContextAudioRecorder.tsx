"use client";

import { DreamAudioRecorder } from "@/components/reset/DreamAudioRecorder";

type ContextAudioRecorderProps = {
  onAudioUploaded: (
    path: string,
    previewUrl: string
  ) => void;
};

export function ContextAudioRecorder({
  onAudioUploaded,
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
        onAudioUploaded={onAudioUploaded}
      />
    </div>
  );
}
