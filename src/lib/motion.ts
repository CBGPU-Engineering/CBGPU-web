/** Product motion: immediate feedback, restrained springs, no simulated progress. */
export const motionTiming = { press: 0.12, feedback: 0.18, surface: 0.24, page: 0.3, success: 0.7 } as const;
export const productSpring = { type: 'spring', stiffness: 460, damping: 34, mass: 0.8 } as const;
export const pressSpring = { type: 'spring', stiffness: 620, damping: 32, mass: 0.65 } as const;
export const settleEase = [0.22, 1, 0.36, 1] as const;
