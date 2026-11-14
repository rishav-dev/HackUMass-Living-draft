import { useEffect, useRef, useState } from 'react';
import { Eraser, Undo2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TextInput } from '../ui/controls';

interface Stroke {
  color: string;
  points: Array<[number, number, number]>;
}

const WIDTH = 1200;
const HEIGHT = 760;
const INKS = ['#f5f3ff', '#fde68a', '#f0abfc', '#7dd3fc'];

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = '#0b0916';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = 'rgba(196, 181, 253, 0.12)';
  ctx.lineWidth = 1;
  for (let y = 70; y < HEIGHT; y += 56) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(WIDTH - 40, y);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    ctx.strokeStyle = stroke.color;
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = 6;
    for (let i = 1; i < stroke.points.length; i += 1) {
      const [x0, y0, p0] = stroke.points[i - 1]!;
      const [x1, y1, p1] = stroke.points[i]!;
      ctx.lineWidth = 2 + ((p0 + p1) / 2) * 6;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    if (stroke.points.length === 1) {
      const [x, y, p] = stroke.points[0]!;
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(x, y, 1 + p * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

export function InkPad({
  onSave,
  onClose,
}: {
  onSave: (image: Blob, caption: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [ink, setInk] = useState(INKS[0]!);
  const [count, setCount] = useState(0);
  const [caption, setCaption] = useState('');

  const redraw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) paint(ctx, current.current ? [...strokes.current, current.current] : strokes.current);
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) paint(ctx, strokes.current);
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const pressure = event.pointerType === 'pen' ? event.pressure || 0.5 : 0.45;
    return [
      ((event.clientX - rect.left) / rect.width) * WIDTH,
      ((event.clientY - rect.top) / rect.height) * HEIGHT,
      pressure,
    ];
  };

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onSave(blob, caption.trim());
    }, 'image/png');
  };

  return (
    <Dialog
      open
      onClose={onClose}
      width="max-w-4xl"
      title="Write it by hand"
      description="Use a pen, a finger or the mouse. It's kept as an image with this memory. A few typed words below make it findable in search."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!count}>
            Keep this page
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {INKS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Ink ${color}`}
            aria-pressed={ink === color}
            onClick={() => setInk(color)}
            className={`size-7 rounded-full ring-2 transition ${ink === color ? 'ring-snow' : 'ring-transparent'}`}
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
        <Button
          size="sm"
          variant="ghost"
          icon={<Undo2 className="size-4" />}
          disabled={!count}
          onClick={() => {
            strokes.current.pop();
            setCount(strokes.current.length);
            redraw();
          }}
        >
          Undo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Eraser className="size-4" />}
          disabled={!count}
          onClick={() => {
            strokes.current = [];
            setCount(0);
            redraw();
          }}
        >
          Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        aria-label="Handwriting area"
        className="mt-3 aspect-[120/76] w-full touch-none rounded-2xl ring-1 ring-white/10"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          current.current = { color: ink, points: [point(event)] };
          redraw();
        }}
        onPointerMove={(event) => {
          if (!current.current) return;
          current.current.points.push(point(event));
          redraw();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          strokes.current.push(current.current);
          current.current = null;
          setCount(strokes.current.length);
          redraw();
        }}
        onPointerCancel={() => {
          current.current = null;
          redraw();
        }}
      />
      <TextInput
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What does it say? (optional)"
        aria-label="What the handwriting says"
        className="mt-3"
      />
    </Dialog>
  );
}
