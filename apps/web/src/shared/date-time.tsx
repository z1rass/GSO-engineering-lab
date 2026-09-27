import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { Language } from '../i18n';
import { Icon } from './icon';

type FieldProps = { name: string; label: string; language: Language; defaultValue?: string; readOnly?: boolean };

function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLDivElement | null>, trigger: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { close(); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open, close, root, trigger]);
}

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}
function dateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function formatDate(value: string, language: Language) {
  const date = dateParts(value);
  return date ? new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date) : language === 'de' ? 'Datum wählen' : 'Choose date';
}
function panelPlacement(trigger: HTMLButtonElement | null, preferredHeight: number) {
  const bounds = trigger?.getBoundingClientRect();
  if (!bounds) return { opensUp: false, maxHeight: preferredHeight };
  const above = (trigger?.parentElement?.getBoundingClientRect().top ?? bounds.top) - 12;
  const below = window.innerHeight - bounds.bottom - 12;
  const opensUp = below < preferredHeight && above > below;
  return { opensUp, maxHeight: Math.max(160, Math.floor(opensUp ? above : below)) };
}

export function DateField({ name, label, language, defaultValue = '', readOnly = false }: FieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ opensUp: false, maxHeight: 365 });
  const initial = dateParts(defaultValue) ?? new Date();
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useDismiss(open, () => setOpen(false), root, trigger);
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLButtonElement>('.calendar-day[aria-pressed="true"], .calendar-day[data-today], .calendar-day')?.focus();
  }, [open]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  const todayValue = dateValue(today.getFullYear(), today.getMonth(), today.getDate());
  const locale = language === 'de' ? 'de-DE' : 'en-GB';
  const weekdays = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + day)));
  return <div className="schedule-field" ref={root}>
    <span className="schedule-field-label">{label}</span>
    <input type="hidden" name={name} value={value} />
    <button ref={trigger} type="button" className="schedule-trigger" data-picker-name={name} disabled={readOnly} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={`${label}: ${formatDate(value, language)}`} onClick={() => { setPlacement(panelPlacement(trigger.current, 365)); setOpen(current => !current); }}><Icon name="calendar" /><span>{formatDate(value, language)}</span><Icon name="chevron-down" size={15} /></button>
    {open && <div className="schedule-popover calendar-popover" data-opens-up={placement.opensUp || undefined} style={{ maxHeight: placement.maxHeight }} role="dialog" id={panelId} aria-label={label}>
      <div className="calendar-heading"><strong>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}</strong><div><button type="button" aria-label={language === 'de' ? 'Vorheriger Monat' : 'Previous month'} onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><Icon name="chevron-left" /></button><button type="button" aria-label={language === 'de' ? 'Nächster Monat' : 'Next month'} onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><Icon name="chevron-right" /></button></div></div>
      <div className="calendar-grid">{weekdays.map((weekday, index) => <span className="calendar-weekday" key={index}>{weekday}</span>)}{Array.from({ length: firstOffset }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: count }, (_, index) => { const day = index + 1; const date = dateValue(year, monthIndex, day); return <button key={date} type="button" className="calendar-day" data-today={date === todayValue || undefined} aria-pressed={date === value} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(year, monthIndex, day))} onClick={() => { setValue(date); setOpen(false); trigger.current?.focus(); }}>{day}</button>; })}</div>
      <div className="calendar-footer"><button type="button" onClick={() => { setValue(todayValue); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setOpen(false); trigger.current?.focus(); }}>{language === 'de' ? 'Heute' : 'Today'}</button><button type="button" onClick={() => { setValue(''); setOpen(false); trigger.current?.focus(); }}>{language === 'de' ? 'Entfernen' : 'Clear'}</button></div>
    </div>}
  </div>;
}

export function TimeField({ name, label, language, defaultValue = '', readOnly = false }: FieldProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ opensUp: false, maxHeight: 325 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useDismiss(open, () => setOpen(false), root, trigger);
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLButtonElement>('.time-options button[aria-pressed="true"], .time-options button')?.focus();
  }, [open]);
  const suggested = Array.from({ length: 29 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`);
  return <div className="schedule-field" ref={root}>
    <span className="schedule-field-label">{label}</span>
    <input type="hidden" name={name} value={value} />
    <button ref={trigger} type="button" className="schedule-trigger" data-picker-name={name} disabled={readOnly} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={`${label}: ${value || (language === 'de' ? 'Zeit wählen' : 'Choose time')}`} onClick={() => { setPlacement(panelPlacement(trigger.current, 325)); setOpen(current => !current); }}><Icon name="clock" /><span>{value || (language === 'de' ? 'Zeit wählen' : 'Choose time')}</span><Icon name="chevron-down" size={15} /></button>
    {open && <div className="schedule-popover time-popover" data-opens-up={placement.opensUp || undefined} style={{ maxHeight: placement.maxHeight }} role="dialog" id={panelId} aria-label={label}>
      <div className="time-popover-heading"><strong>{label}</strong><span>{language === 'de' ? 'Europe/Berlin' : 'Europe/Berlin'}</span></div>
      <div className="time-options">{suggested.map(time => <button type="button" key={time} aria-pressed={value === time} onClick={() => { setValue(time); setOpen(false); trigger.current?.focus(); }}>{time}</button>)}</div>
      <div className="time-custom"><label>{language === 'de' ? 'Andere Uhrzeit' : 'Other time'}<input type="time" value={value} onChange={event => setValue(event.target.value)} /></label><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }}>{language === 'de' ? 'Fertig' : 'Done'}</button></div>
      <button className="time-clear" type="button" onClick={() => { setValue(''); setOpen(false); trigger.current?.focus(); }}>{language === 'de' ? 'Zeit entfernen' : 'Clear time'}</button>
    </div>}
  </div>;
}
