import { useToastStore } from '../store/toast';

export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => remove(t.id)}>{t.message}</div>
      ))}
    </div>
  );
}
