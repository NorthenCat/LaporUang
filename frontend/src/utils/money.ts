export function formatIDR(amount: number): string {
  // Minor units are IDR itself since IDR doesn't use cents/minor units normally,
  // but let's treat the saved integer amount as the actual IDR value.
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
