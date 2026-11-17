import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, Trash2, Upload } from 'lucide-react';
import {
  isValidGroupImageUrl,
  normalizeGroupImageInput,
  processGroupImageFile,
} from '../lib/groupImages';
import { GroupAvatar, ModalDialog } from './RallyComponents';

interface GroupImageEditorProps {
  groupName: string;
  imageUrl: string | null | undefined;
  isBusy?: boolean;
  onChangeImage: (nextUrl: string | null) => void;
  compact?: boolean;
  testIdPrefix?: string;
}

export function GroupImageEditor({
  groupName,
  imageUrl,
  isBusy = false,
  onChangeImage,
  compact = false,
  testIdPrefix = 'group_image',
}: GroupImageEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlInput, setUrlInput] = useState(
    imageUrl && imageUrl.startsWith('https://') ? imageUrl : ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLocalError(null);
    setIsProcessing(true);
    try {
      const encoded = await processGroupImageFile(file);
      setUrlInput('');
      onChangeImage(encoded);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not process image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUrl = () => {
    setLocalError(null);
    const cleaned = normalizeGroupImageInput(urlInput);
    if (!cleaned) {
      onChangeImage(null);
      return;
    }
    if (!cleaned.startsWith('https://') || !isValidGroupImageUrl(cleaned)) {
      setLocalError('Enter a valid https:// image URL (max 1,000 characters).');
      return;
    }
    onChangeImage(cleaned);
  };

  const hasImage = Boolean(imageUrl && imageUrl.trim().length > 0);
  const busy = isBusy || isProcessing;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3.5">
        <GroupAvatar
          groupName={groupName || 'RallyHub'}
          imageUrl={imageUrl}
          size={compact ? 'md' : 'xl'}
          testId={`${testIdPrefix}_preview`}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => void handleFileSelected(e)}
              disabled={busy}
              data-testid={`${testIdPrefix}_file_input`}
              className="hidden"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              data-testid={`${testIdPrefix}_upload_button`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>{hasImage ? 'Upload New Image' : 'Upload Image'}</span>
            </button>

            {hasImage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLocalError(null);
                  setUrlInput('');
                  onChangeImage(null);
                }}
                data-testid={`${testIdPrefix}_remove_button`}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--rally-error)]/35 px-2.5 py-1.5 text-xs font-semibold text-[var(--rally-error)] transition hover:bg-[var(--rally-error)]/10 disabled:opacity-45"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-[var(--rally-on-surface-variant)]">
            PNG, JPG, WebP, or GIF (automatically cropped &amp; optimized) or paste an HTTPS image
            URL below.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--rally-on-surface-variant)]" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder="https://example.com/group-logo.png"
            disabled={busy}
            data-testid={`${testIdPrefix}_url_input`}
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] py-2 pl-8 pr-3 text-xs focus:border-[var(--rally-primary)] focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          disabled={busy || urlInput.trim().length === 0}
          onClick={handleApplyUrl}
          data-testid={`${testIdPrefix}_apply_url_button`}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[var(--rally-primary)] px-3 py-2 text-xs font-semibold text-[var(--rally-primary)] transition hover:bg-[var(--rally-primary-container)]/40 disabled:opacity-45"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span>Use URL</span>
        </button>
      </div>

      {localError && (
        <p data-testid={`${testIdPrefix}_error`} className="text-xs font-medium text-[var(--rally-error)]">
          {localError}
        </p>
      )}
    </div>
  );
}

export function GroupImageDialog({
  open,
  groupName,
  initialImageUrl,
  isBusy,
  onClose,
  onSave,
}: {
  open: boolean;
  groupName: string;
  initialImageUrl: string | null;
  isBusy: boolean;
  onClose: () => void;
  onSave: (nextUrl: string | null) => void;
}) {
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(initialImageUrl);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`Group Profile Image — ${groupName}`}
      maxWidthClass="max-w-md"
      footer={
        <>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onSave(draftImageUrl)}
            data-testid="save_group_image_dialog_button"
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-45"
          >
            {isBusy ? 'Saving...' : 'Save Image'}
          </button>
        </>
      }
    >
      <p className="text-xs text-[var(--rally-on-surface-variant)]">
        Set a custom group profile image to visually distinguish this community in the main hub and
        group header.
      </p>
      <GroupImageEditor
        groupName={groupName}
        imageUrl={draftImageUrl}
        isBusy={isBusy}
        onChangeImage={setDraftImageUrl}
        testIdPrefix="hub_dialog_group_image"
      />
    </ModalDialog>
  );
}
