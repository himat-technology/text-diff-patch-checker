import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { ACCEPT_ATTRIBUTE } from '../utils/fileReader';

interface Props {
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

/** A button that opens the native file picker. Files are only read locally. */
export function FileUploader({ label, onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          // Allow selecting the same file again.
          e.target.value = '';
        }}
      />
    </>
  );
}
