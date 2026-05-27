// BMI is computed on demand from the profile height + a weight, so a height
// correction instantly affects every reading (nothing stale is stored).

export function computeBmi(weightKg: number, heightCm: number | null): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export interface BmiBand {
  label: string;
  color: string;
}

// Standard WHO adult bands.
export function bmiCategory(bmi: number): BmiBand {
  if (bmi < 18.5) return { label: 'Underweight', color: '#2563eb' };
  if (bmi < 25) return { label: 'Normal', color: '#16a34a' };
  if (bmi < 30) return { label: 'Overweight', color: '#ea580c' };
  return { label: 'Obese', color: '#dc2626' };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
