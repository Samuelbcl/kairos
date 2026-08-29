import { Badge } from "@/components/ui/badge";

/**
 * Tag affiché à sa couleur de catalogue. Un tag absent du catalogue (arrivé
 * par import, par exemple) reste affiché en neutre plutôt que masqué.
 */
export function TagBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={className}
      style={
        color
          ? {
              backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)`,
              color,
            }
          : undefined
      }
    >
      {name}
    </Badge>
  );
}
