// Global type declarations — custom web components and shared augmentations.

import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "tavus-embed": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        "deployment-id"?: string;
        "conversational-context"?: string;
        style?: React.CSSProperties;
      };
    }
  }
}
