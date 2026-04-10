'use client';

import dynamic from 'next/dynamic';
import {
  ReactCompareSliderImage,
} from 'react-compare-slider';

const ReactCompareSlider = dynamic(
  () => import('react-compare-slider').then((mod) => mod.ReactCompareSlider),
  { ssr: false },
);

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export default function ImageCompare() {
  return (
    <div className="image-compare-wrap">
      <div className="image-compare-labels">
        {/* <span className="image-compare-label image-compare-label--left">Without Mellea</span>
        <span className="image-compare-label image-compare-label--right">With Mellea</span> */}
      </div>

      <ReactCompareSlider
        itemOne={
          <ReactCompareSliderImage
            src={`${basePath}/images/without-mellea.png`}
            alt="Without Mellea — complex unstructured system prompt"
          />
        }
        itemTwo={
          <ReactCompareSliderImage
            src={`${basePath}/images/with-mellea.png`}
            alt="With Mellea — structured, type-annotated Python"
          />
        }
        handle={
          <div className="image-compare-handle">
            <div className="image-compare-handle-line" />
            <div className="image-compare-handle-grip">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" transform="scale(-1,1) translate(-24,0)"/>
              </svg>
            </div>
            <div className="image-compare-handle-line" />
          </div>
        }
        style={{ borderRadius: '0 4px 4px 4px' }}
      />
    </div>
  );
}
