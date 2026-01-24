import Typograf from 'typograf';

export const setViewportHeightVar = () => {
  const setVh = () => {
    const vh = window.innerHeight * 0.01;

    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };

  setVh();
  window.addEventListener('resize', setVh);

  return () => window.removeEventListener('resize', setVh);
}

export const preloadItems = (sources: Array<string>) => {  
  return Promise.all(
    sources.map(
      (src: string) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.src = src;
        })
    )
  );
}

const tp = new Typograf({ locale: ['ru', 'en-US'] });

export const formatText = (text: string): string => {
  return tp.execute(text);
}