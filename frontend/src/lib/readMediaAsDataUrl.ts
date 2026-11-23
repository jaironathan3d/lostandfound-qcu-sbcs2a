export const readMediaAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') resolve(reader.result);
    else reject(new Error('The selected media could not be read.'));
  };
  reader.onerror = () => reject(new Error('The selected media could not be read.'));
  reader.readAsDataURL(file);
});
