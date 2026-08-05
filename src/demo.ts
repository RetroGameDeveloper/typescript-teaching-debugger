import "./ts-teaching-debugger";
import type { TsTeachingDebuggerElement } from "./ts-teaching-debugger";

const source = `interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

function lineTotal(item: CartItem): number {
  const subtotal = item.price * item.quantity;
  return subtotal;
}

function cartTotal(items: CartItem[]): number {
  let total = 0;

  for (const item of items) {
    total += lineTotal(item);
  }

  return total;
}

const basket: CartItem[] = [
  { name: "Notebook", price: 4, quantity: 2 },
  { name: "Pen", price: 1.5, quantity: 3 },
];

const result = cartTotal(basket);
console.log("Cart total:", result);`;

const teachingDebugger = document.querySelector<TsTeachingDebuggerElement>(
  "#debugger",
);

if (teachingDebugger) {
  teachingDebugger.code = source;
  teachingDebugger.breakpoints = [9, 24];
}
