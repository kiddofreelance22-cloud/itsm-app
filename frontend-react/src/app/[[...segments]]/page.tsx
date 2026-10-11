"use client";

import { App } from "../../App";
import { Providers } from "../providers";

export default function Page() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}