export const money = (value: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value);
export const productPrice = (value: number, unconfirmed?: number | boolean) =>
  unconfirmed ? "Not confirmed yet" : money(value);
