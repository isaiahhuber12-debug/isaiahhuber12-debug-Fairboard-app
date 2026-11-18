import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  MessageSquareShare,
  Phone,
  Smartphone,
  Users,
} from 'lucide-react';
import {
  buildDeviceSmsUri,
  E164_PHONE_REGEX,
  formatPhoneDisplay,
  normalizePhoneInput,
  parsePhoneListInput,
} from '../services/smsService';
import {
  type GroupMember,
  type MemberContactInfo,
  MemberRole,
  parseMemberRole,
  ROLE_META,
} from '../types/rally';
import { ModalDialog, RoleBadge } from './RallyComponents';

export interface GroupSmsComposerModalProps {
  open: boolean;
  onClose: () => void;
  groupName: string | null;
  members: GroupMember[];
  memberContactsByUid: Record<string, MemberContactInfo>;
  initialRecipientPhones?: string[];
  initialMessage?: string;
  onBanner?: (message: string) => void;
}

export function GroupSmsComposerModal(props: GroupSmsComposerModalProps) {
  if (!props.open) return null;
  const seedKey = `${props.groupName ?? 'hub'}_${(props.initialRecipientPhones ?? []).join(',')}_${props.initialMessage ?? ''}`;
  return <GroupSmsComposerModalBody key={seedKey} {...props} />;
}

function GroupSmsComposerModalBody({
  onClose,
  groupName,
  members,
  memberContactsByUid,
  initialRecipientPhones,
  initialMessage = '',
  onBanner,
}: GroupSmsComposerModalProps) {
  const membersWithPhones = useMemo(() => {
    return members
      .map((member) => {
        const contact = memberContactsByUid[member.uid];
        const normalized = contact?.phoneNumber ? normalizePhoneInput(contact.phoneNumber) : '';
        if (!normalized || !E164_PHONE_REGEX.test(normalized)) return null;
        return {
          member,
          contact,
          phone: normalized,
          role: parseMemberRole(member.role),
        };
      })
      .filter(
        (
          entry
        ): entry is {
          member: GroupMember;
          contact: MemberContactInfo;
          phone: string;
          role: MemberRole;
        } => entry !== null
      );
  }, [members, memberContactsByUid]);

  const initialNormalizedSet = useMemo(() => {
    const list = (initialRecipientPhones ?? [])
      .map((p) => normalizePhoneInput(p))
      .filter((p) => E164_PHONE_REGEX.test(p));
    return new Set(list);
  }, [initialRecipientPhones]);

  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(() => {
    if (initialNormalizedSet.size > 0) {
      return new Set(initialNormalizedSet);
    }
    return new Set(membersWithPhones.map((m) => m.phone));
  });

  const [manualPhonesRaw, setManualPhonesRaw] = useState<string>(() => {
    if (initialNormalizedSet.size === 0) return '';
    const rosterPhones = new Set(membersWithPhones.map((m) => m.phone));
    const extras = Array.from(initialNormalizedSet).filter((p) => !rosterPhones.has(p));
    return extras.join(', ');
  });

  const [roleFilter, setRoleFilter] = useState<'ALL' | MemberRole>('ALL');
  const [includeGroupPrefix, setIncludeGroupPrefix] = useState<boolean>(Boolean(groupName));
  const [messageBody, setMessageBody] = useState<string>(initialMessage);
  const [copiedNumbers, setCopiedNumbers] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const visibleMemberEntries = useMemo(() => {
    if (roleFilter === 'ALL') return membersWithPhones;
    return membersWithPhones.filter((entry) => entry.role === roleFilter);
  }, [membersWithPhones, roleFilter]);

  const parsedManualPhones = useMemo(
    () => parsePhoneListInput(manualPhonesRaw),
    [manualPhonesRaw]
  );

  const allRecipientPhones = useMemo(() => {
    const combined = new Set<string>();
    for (const p of selectedPhones) {
      if (E164_PHONE_REGEX.test(p)) combined.add(p);
    }
    for (const p of parsedManualPhones) {
      if (E164_PHONE_REGEX.test(p)) combined.add(p);
    }
    return Array.from(combined);
  }, [selectedPhones, parsedManualPhones]);

  const formattedSmsText = useMemo(() => {
    const trimmed = messageBody.trim();
    if (!trimmed) return '';
    if (includeGroupPrefix && groupName?.trim()) {
      return `[${groupName.trim()}] ${trimmed}`;
    }
    return trimmed;
  }, [messageBody, includeGroupPrefix, groupName]);

  const deviceSmsUri = useMemo(
    () => buildDeviceSmsUri(allRecipientPhones, formattedSmsText),
    [allRecipientPhones, formattedSmsText]
  );

  const togglePhone = (phone: string) => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  };

  const handleSelectVisible = () => {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      for (const item of visibleMemberEntries) {
        next.add(item.phone);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedPhones(new Set());
  };

  const handleCopyNumbers = async () => {
    if (allRecipientPhones.length === 0 || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(allRecipientPhones.join(', '));
      setCopiedNumbers(true);
      onBanner?.(`Copied ${allRecipientPhones.length} phone number(s)`);
      window.setTimeout(() => setCopiedNumbers(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyMessage = async () => {
    if (!formattedSmsText || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(formattedSmsText);
      setCopiedMessage(true);
      onBanner?.('Copied SMS message text');
      window.setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };
  const [sendingCloudSms, setSendingCloudSms] = useState(false);

  const handleSendCloudSms = async () => {
    if (!allRecipientPhones.length || !formattedSmsText.trim()) return;

    let apiKey = window.localStorage.getItem('rallyhub_textbee_api_key') || '';
    if (!apiKey) {
      const entered = window.prompt('Enter your TextBee API Key (from textbee.dev):');
      if (!entered || !entered.trim()) return;
      apiKey = entered.trim();
      window.localStorage.setItem('rallyhub_textbee_api_key', apiKey);
    }

    const recipients = allRecipientPhones.map((phone) => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      return phone.startsWith('+') ? phone : `+${digits}`;
    });

    setSendingCloudSms(true);
    try {
      const response = await fetch('https://textbee.dev', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          recipients,
          message: formattedSmsText,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          window.localStorage.removeItem('rallyhub_textbee_api_key');
        }
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || `TextBee error (${response.status})`);
      }

      onBanner?.(`Cloud SMS sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}!`);
    } catch (error) {
      onBanner?.(error instanceof Error ? error.message : 'Failed to send Cloud SMS.');
      
    } finally {
      setSendingCloudSms(false);
    }}
  };
  const canLaunchDeviceSms = allRecipientPhones.length > 0;
  const smsSegments = Math.max(1, Math.ceil((formattedSmsText.length || 1) / 160));

  return (
    <ModalDialog
      open
      onClose={onClose}
      title="Text via Your SMS App"
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={allRecipientPhones.length === 0}
              onClick={() => void handleCopyNumbers()}
              data-testid="sms_composer_copy_numbers_button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
            >
              {copiedNumbers ? (
                <Check className="h-3.5 w-3.5 text-[var(--rally-tertiary)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedNumbers ? 'Numbers Copied' : `Copy Numbers (${allRecipientPhones.length})`}</span>
            </button>
            <button
              type="button"
              disabled={!formattedSmsText}
              onClick={() => void handleCopyMessage()}
              data-testid="sms_composer_copy_message_button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--rally-outline)] px-3 py-2 text-xs font-semibold text-[var(--rally-on-surface)] transition hover:bg-[var(--rally-surface-variant)] disabled:opacity-45"
            >
              {copiedMessage ? (
                <Check className="h-3.5 w-3.5 text-[var(--rally-tertiary)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{copiedMessage ? 'Text Copied' : 'Copy Text'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
<button type="button" onClick={() => void handleSendCloudSms()} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{sendingCloudSms ? 'Sending...' : `Send Cloud SMS (${allRecipientPhones.length})`}  </button>          {canLaunchDeviceSms && deviceSmsUri ? (
              <a
                href={deviceSmsUri}
                data-testid="sms_composer_open_messages_link"
                onClick={() => {
                  onBanner?.(
                    `Opening SMS app with ${allRecipientPhones.length} recipient${allRecipientPhones.length === 1 ? '' : 's'}...`
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:brightness-110"
              >
                <MessageSquareShare className="h-4 w-4" />
                <span>Open in SMS App ({allRecipientPhones.length})</span>
              </a>
            ) : (
              <span
                data-testid="sms_composer_open_messages_disabled"
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-[var(--rally-primary)] px-4 py-2 text-xs font-semibold text-white opacity-45"
              >
                <MessageSquareShare className="h-4 w-4" />
                <span>Open in SMS App (0)</span>
              </span>
            )}
          </div>
        </div>
      }
    >
      <div data-testid="group_sms_composer_modal" className="space-y-4">
        <div className="rounded-2xl border border-[var(--rally-primary)]/25 bg-[var(--rally-primary-container)]/45 p-3 text-xs leading-relaxed text-[var(--rally-on-primary-container)]">
          <div className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong className="font-semibold">Device Texting:</strong> Select group members
              below or enter any cell phone numbers, write your message, and tap{' '}
              <strong className="font-semibold">Open in SMS App</strong> to send directly from your
              phone or Messages app.
            </div>
          </div>
        </div>

        {/* Member Phone Directory Picker */}
        {membersWithPhones.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
                <Users className="h-3.5 w-3.5" />
                <span>Group Members with Cell Numbers ({membersWithPhones.length})</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={handleSelectVisible}
                  data-testid="sms_select_visible_members_button"
                  className="text-[var(--rally-primary)] hover:underline"
                >
                  Select Shown
                </button>
                <span className="text-[var(--rally-outline)]">•</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  data-testid="sms_clear_members_button"
                  className="text-[var(--rally-on-surface-variant)] hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: MemberRole.PARTICIPANT, label: 'Participants' },
                  { id: MemberRole.ORGANIZER, label: 'Organizers' },
                  { id: MemberRole.ADMIN, label: 'Admins' },
                ] as const
              ).map((chip) => {
                const active = roleFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setRoleFilter(chip.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      active
                        ? 'border-[var(--rally-primary)] bg-[var(--rally-primary-container)] text-[var(--rally-on-primary-container)]'
                        : 'border-[var(--rally-outline)] text-[var(--rally-on-surface-variant)] hover:bg-[var(--rally-surface-variant)]/50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div className="max-h-44 divide-y divide-[var(--rally-outline)]/40 overflow-y-auto rounded-2xl border border-[var(--rally-outline)]/65 bg-[var(--rally-bg)]/45">
              {visibleMemberEntries.length === 0 ? (
                <div className="p-3 text-xs text-[var(--rally-on-surface-variant)]">
                  No members with phone numbers in this role filter.
                </div>
              ) : (
                visibleMemberEntries.map(({ member, phone, role }) => {
                  const checked = selectedPhones.has(phone);
                  return (
                    <label
                      key={member.uid}
                      className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs transition hover:bg-[var(--rally-surface-variant)]/40"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePhone(phone)}
                          data-testid={`sms_recipient_checkbox_${member.uid}`}
                          className="h-4 w-4 rounded accent-[var(--rally-primary)]"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-semibold text-[var(--rally-on-surface)]">
                              {member.displayName}
                            </span>
                            <RoleBadge role={role} />
                          </div>
                          <div className="font-mono-code text-[11px] text-[var(--rally-on-surface-variant)]">
                            {formatPhoneDisplay(phone)}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-[var(--rally-on-surface-variant)]">
                        {ROLE_META[role].label}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Custom / Additional Phone Numbers */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
            <Phone className="h-3.5 w-3.5" />
            <span>
              {membersWithPhones.length > 0
                ? 'Additional Phone Numbers (Optional)'
                : 'Recipient Cell Phone Numbers'}
            </span>
          </label>
          <input
            type="text"
            value={manualPhonesRaw}
            onChange={(e) => setManualPhonesRaw(e.target.value)}
            placeholder="e.g. (555) 123-4567, +15559876543"
            data-testid="sms_manual_phones_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2 font-mono-code text-xs focus:border-[var(--rally-primary)] focus:outline-none"
          />
          <p className="text-[11px] text-[var(--rally-on-surface-variant)]">
            Separate multiple numbers with commas or semicolons. 10-digit US numbers auto-format to
            +1.
          </p>
        </div>

        {/* SMS Message Body */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--rally-on-surface-variant)]">
              SMS Message
            </label>
            {groupName && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[var(--rally-on-surface-variant)]">
                <input
                  type="checkbox"
                  checked={includeGroupPrefix}
                  onChange={(e) => setIncludeGroupPrefix(e.target.checked)}
                  data-testid="sms_prefix_group_checkbox"
                  className="h-3.5 w-3.5 rounded accent-[var(--rally-primary)]"
                />
                <span>Prefix with [{groupName}]</span>
              </label>
            )}
          </div>
          <textarea
            rows={4}
            maxLength={480}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Write your text message update for members..."
            data-testid="sms_message_body_input"
            className="w-full rounded-xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] px-3.5 py-2.5 text-sm focus:border-[var(--rally-primary)] focus:outline-none"
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--rally-on-surface-variant)]">
            <span>
              {allRecipientPhones.length} valid phone number
              {allRecipientPhones.length === 1 ? '' : 's'} selected
            </span>
            <span>
              {formattedSmsText.length}/480 chars ({smsSegments} SMS segment
              {smsSegments === 1 ? '' : 's'})
            </span>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}
