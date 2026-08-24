import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'tavus-embed': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { 'deployment-id'?: string };
    }
  }
}
