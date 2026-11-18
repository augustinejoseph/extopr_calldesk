"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Dropdown({
  options,
  value,
  defaultValue = "",
  onChange,
  name,
  required = false,
  disabled = false,
  "aria-label": label,
}) {
  const id = useId(),
    root = useRef(null),
    trigger = useRef(null),
    menu = useRef(null),
    search = useRef({ text: "", time: 0 });
  const [internal, setInternal] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [position, setPosition] = useState({});
  const controlled = value !== undefined,
    current = controlled ? value : internal;
  const selected = options.find((option) => option.value === current);
  useEffect(() => {
    if (!controlled) setInternal(defaultValue);
  }, [defaultValue, controlled]);
  useEffect(() => {
    const form = root.current?.closest("form");
    const reset = () => {
      if (!controlled) setInternal(defaultValue);
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [controlled, defaultValue]);
  useEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect(),
      height = Math.min(280, window.innerHeight - 24),
      below = window.innerHeight - rect.bottom - 12,
      above = rect.top - 12;
    setPosition({
      left: Math.max(
        8,
        Math.min(
          rect.left,
          window.innerWidth - Math.min(rect.width, window.innerWidth - 16) - 8,
        ),
      ),
      width: Math.min(rect.width, window.innerWidth - 16),
      maxHeight: Math.min(height, Math.max(below, above)),
      ...(below >= Math.min(height, above)
        ? { top: rect.bottom + 5 }
        : { bottom: window.innerHeight - rect.top + 5 }),
    });
    const outside = (e) => {
      if (
        !root.current?.contains(e.target) &&
        !menu.current?.contains(e.target)
      )
        setOpen(false);
    };
    const scroll = (e) => {
      if (!menu.current?.contains(e.target)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open || !menu.current) return;
    const option = menu.current.querySelector(`[data-index="${index}"]`);
    if (!option) return;
    if (option.offsetTop < menu.current.scrollTop)
      menu.current.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      menu.current.scrollTop + menu.current.clientHeight
    )
      menu.current.scrollTop =
        option.offsetTop + option.offsetHeight - menu.current.clientHeight;
  }, [index, open]);
  function show() {
    setIndex(
      Math.max(
        0,
        options.findIndex((o) => o.value === current && !o.disabled),
      ),
    );
    setOpen(true);
  }
  function choose(option) {
    if (option.disabled) return;
    if (!controlled) setInternal(option.value);
    onChange?.(option.value);
    setOpen(false);
    trigger.current?.focus();
  }
  function keyboard(e) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!open) {
        show();
        return;
      }
      const enabled = options
        .map((o, i) => (o.disabled ? -1 : i))
        .filter((i) => i !== -1);
      const next =
        e.key === "Home"
          ? enabled[0]
          : e.key === "End"
            ? enabled.at(-1)
            : enabled[
                (enabled.indexOf(index) +
                  (e.key === "ArrowDown" ? 1 : -1) +
                  enabled.length) %
                  enabled.length
              ];
      if (next !== undefined) setIndex(next);
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && open) {
      e.preventDefault();
      if (options[index]) choose(options[index]);
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      search.current = {
        text:
          Date.now() - search.current.time > 700
            ? e.key
            : search.current.text + e.key,
        time: Date.now(),
      };
      const found = options.findIndex(
        (o) =>
          !o.disabled &&
          o.label.toLowerCase().startsWith(search.current.text.toLowerCase()),
      );
      if (found >= 0) {
        e.preventDefault();
        setIndex(found);
        setOpen(true);
      }
    }
  }
  return (
    <div className="dropdown" ref={root}>
      <input
        className="dropdown-value"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        value={current}
        onChange={() => {}}
        required={required}
        disabled={disabled}
        onInvalid={(e) => {
          e.preventDefault();
          trigger.current?.focus();
          show();
        }}
      />
      <button
        ref={trigger}
        disabled={disabled}
        type="button"
        className="dropdown-trigger"
        role="combobox"
        aria-label={label}
        aria-required={required || undefined}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={
          open && options[index] ? `${id}-${index}` : undefined
        }
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={keyboard}
        onBlur={(e) => {
          if (!menu.current?.contains(e.relatedTarget)) setOpen(false);
        }}
      >
        <span>{selected?.label || "Choose an option"}</span>
        <span className="dropdown-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            className="dropdown-menu"
            style={position}
            onPointerDown={(e) => e.preventDefault()}
          >
            {options.map((option, i) => (
              <div
                key={option.value}
                id={`${id}-${i}`}
                data-index={i}
                role="option"
                aria-selected={current === option.value}
                aria-disabled={option.disabled || undefined}
                className={`dropdown-option ${i === index ? "highlighted" : ""}`}
                onPointerMove={() => {
                  if (!option.disabled) setIndex(i);
                }}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {current === option.value && <span aria-hidden="true">✓</span>}
              </div>
            ))}
          </div>,
          root.current?.closest('[role="dialog"]') || document.body,
        )}
    </div>
  );
}
