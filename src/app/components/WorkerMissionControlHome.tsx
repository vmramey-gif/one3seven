type WorkerMissionControlHomeProps = {
  greetingName?: string | null;
};

function resolvePacificGreeting(name: string | null | undefined): string {
  const firstName = name?.trim().split(/\s+/)[0] ?? '';
  try {
    const hourText = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Los_Angeles',
    }).format(new Date());
    const hour = Number.parseInt(hourText, 10);
    if (Number.isNaN(hour)) {
      return firstName ? `Welcome back, ${firstName}` : 'Welcome back';
    }
    const timeGreeting =
      hour >= 5 && hour < 12
        ? 'Good morning'
        : hour >= 12 && hour < 17
          ? 'Good afternoon'
          : 'Good evening';
    return firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;
  } catch {
    return firstName ? `Welcome back, ${firstName}` : 'Welcome back';
  }
}

export function WorkerMissionControlHome({
  greetingName,
}: WorkerMissionControlHomeProps) {
  const headline = resolvePacificGreeting(greetingName);

  return (
    <div className="mx-auto flex min-h-[min(680px,calc(100vh-8.5rem))] w-full max-w-[680px] flex-col rounded-[32px] border border-[#D3DED6] bg-white/95 px-6 py-8 text-center shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:px-10 sm:py-10">
      <header className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center py-16 sm:py-20">
        <h1 className="font-display text-[clamp(1.75rem,5.8vw,2.25rem)] font-medium leading-[1.12] tracking-[-0.02em] text-transparent bg-[linear-gradient(110deg,#1E1B4B_0%,#374A42_42%,#1E1B4B_78%)] bg-[length:220%_100%] bg-clip-text animate-[pulse_3s_ease-in-out_infinite]">
          {headline}
        </h1>
      </header>
    </div>
  );
}
