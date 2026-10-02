import { useId } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}

/** A radio group styled as a segmented control; native radios give keyboard support. */
export function SegmentedControl<T extends string>({ label, value, options, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="control-label mb-1">{label}</legend>
      <div className="seg-group">
        {options.map((opt) => {
          const id = `${name}-${opt.value}`;
          const active = opt.value === value;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              title={opt.title}
              className={`seg-item has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600 ${active ? 'seg-item-active' : ''}`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={opt.value}
                checked={active}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
