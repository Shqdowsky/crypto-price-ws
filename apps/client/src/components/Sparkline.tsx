interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/** Tiny decorative price chart. Green when the series ends above where it started, red when below. */
export function Sparkline({ values, width = 120, height = 36 }: SparklineProps) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          className="stroke-line-strong"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (pad + (1 - (v - min) / range) * (height - pad * 2)).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");

  const trend = values[values.length - 1] - values[0];
  const stroke = trend > 0 ? "stroke-up" : trend < 0 ? "stroke-down" : "stroke-muted";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        className={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
