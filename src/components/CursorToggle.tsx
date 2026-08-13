import { assetUrl } from '@/lib/assetUrl';

export default function CursorToggle() {
  return (
    <div id="cursor-toggle" className="cursor-toggle cursor-toggle--off" role="presentation">
      <button
        type="button"
        className="cursor-toggle__button"
        aria-pressed="false"
        aria-label="Turn custom cursor on"
      >
        <span className="cursor-toggle__icon-slot" aria-hidden="true">
          <img
            className="cursor-toggle__icon cursor-toggle__icon--mel-on"
            src={assetUrl('/assets/mel-on.svg')}
            alt=""
            width={38}
            height={32}
          />
          <img
            className="cursor-toggle__icon cursor-toggle__icon--mel-off"
            src={assetUrl('/assets/mel-off.svg')}
            alt=""
            width={38}
            height={35}
          />
        </span>

        <span className="cursor-toggle__switch" aria-hidden="true">
          <span className="cursor-toggle__track">
            <span className="cursor-toggle__label">OFF</span>
            <span className="cursor-toggle__thumb" />
          </span>
        </span>
      </button>
    </div>
  );
}
