import type { DiffSegment } from '../../diff/diffTypes';

interface Props {
  text: string;
  segments?: DiffSegment[];
  noEol?: boolean;
}

/** Renders a line, with <del>/<ins> for inline word/character changes. */
export function LineContent({ text, segments, noEol }: Props) {
  return (
    <>
      {segments
        ? segments.map((s, i) =>
            s.type === 'equal' ? (
              <span key={i}>{s.text}</span>
            ) : s.type === 'delete' ? (
              <del key={i} className="seg-del">
                {s.text}
              </del>
            ) : (
              <ins key={i} className="seg-ins">
                {s.text}
              </ins>
            ),
          )
        : text}
      {noEol && (
        <span
          className="ml-2 rounded bg-slate-200 px-1 align-[1px] font-sans text-[10px] text-slate-600 no-underline"
          title="No newline at end of file"
        >
          no newline at EOF
        </span>
      )}
    </>
  );
}

/** Visual width in characters, counting tabs as 4 columns. */
export function visualWidth(text: string): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) width += text.charCodeAt(i) === 9 ? 4 - (width % 4) : 1;
  return width;
}

export const ROW_HEIGHT = 20;
export const MAX_VIEW_HEIGHT = 620;
