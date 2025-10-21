type CCTPStep = 'idle' | 'ibc' | 'burn' | 'attest' | 'mint' | 'complete';

interface ProgressStepsProps {
  currentStep: CCTPStep;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  if (currentStep === 'idle' || currentStep === 'complete') return null;

  const steps = ['ibc', 'burn', 'attest', 'mint'] as const;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        {steps.map((step, idx) => (
          <div key={step} className="flex-1">
            <div
              className={`h-2 rounded-full ${
                currentStep === step
                  ? 'bg-indigo-600'
                  : steps.indexOf(currentStep as any) > idx
                  ? 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            />
            <div className="text-xs text-center mt-1 text-gray-600">
              {step.toUpperCase()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
