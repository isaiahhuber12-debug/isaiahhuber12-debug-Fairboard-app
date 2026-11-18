import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, Loader2, QrCode } from 'lucide-react';
import { buildGroupInviteQrValue } from '../lib/qrInvite';
import { ModalDialog } from './RallyComponents';

interface QrInviteShareModalProps {
  open: boolean;
  groupCode: string;
  groupName?: string;
  onClose: () => void;
}

export function QrInviteShareButton({
  groupCode,
  groupName,
  className = '',
}: {
  groupCode: string;
  groupName?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="share_group_qr_button"
        title="Show scannable QR invite code"
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-[10px] border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] ${className}`}
      >
        <QrCode className="h-3.5 w-3.5" />
        <span>Share QR</span>
      </button>
      <QrInviteShareModal
        open={open}
        groupCode={groupCode}
        groupName={groupName}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function QrInviteShareModal({
  open,
  groupCode,
  groupName,
  onClose,
}: QrInviteShareModalProps) {
  if (!open) return null;
  return (
    <QrInviteShareModalBody
      key={`${groupCode}_${groupName ?? ''}`}
      groupCode={groupCode}
      groupName={groupName}
      onClose={onClose}
    />
  );
}

function QrInviteShareModalBody({
  groupCode,
  groupName,
  onClose,
}: {
  groupCode: string;
  groupName?: string;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = buildGroupInviteQrValue(groupCode);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(inviteUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <ModalDialog
      open
      onClose={onClose}
      title="Share Group Invite QR Code"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              data-testid="copy_qr_invite_link_button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--rally-tertiary)]" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={`rallyhub-invite-${groupCode.toLowerCase()}.png`}
                data-testid="download_qr_png_button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download PNG</span>
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            Done
          </button>
        </div>
      }
    >
      <div
        data-testid="qr_invite_share_modal"
        className="flex flex-col items-center space-y-3 text-center"
      >
        {groupName && <div className="font-display text-base font-bold">{groupName}</div>}
        <p className="text-xs text-[var(--rally-on-surface-variant)]">
          Members can scan this QR code using RallyHub&apos;s{' '}
          <strong className="font-semibold text-[var(--rally-on-surface)]">Scan QR</strong>{' '}
          button or their phone camera to join without typing the code.
        </p>

        <div className="flex h-64 w-64 items-center justify-center rounded-2xl border border-[var(--rally-outline)]/70 bg-white p-3 shadow-sm">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for group invite ${groupCode}`}
              data-testid="qr_invite_image"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">Generating QR code...</span>
            </div>
          )}
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl bg-[var(--rally-primary-container)] px-3.5 py-1.5 font-mono-code text-sm font-bold tracking-wider text-[var(--rally-on-primary-container)]">
          <QrCode className="h-4 w-4" />
          <span>{groupCode}</span>
        </div>
      </div>
    </ModalDialog>
  );
}
