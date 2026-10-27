export async function loadDynamic(name: string) {
  return import(`./domain/${name}`);
}
