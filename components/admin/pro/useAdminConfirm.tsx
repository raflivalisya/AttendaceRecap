"use client";

import {
  useCallback,
  useRef,
  useState,
} from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

const emptyState: ConfirmState = {
  open: false,
  title: "",
  message: "",
  confirmLabel: "Lanjutkan",
  cancelLabel: "Batal",
  danger: false,
};

export function useAdminConfirm() {
  const [state, setState] = useState<ConfirmState>(emptyState);

  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;

      setState({
        open: true,
        confirmLabel: "Lanjutkan",
        cancelLabel: "Batal",
        danger: false,
        ...options,
      });
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(emptyState);
  }, []);

  const modal = state.open ? (
    <div className="admin-pro-confirm-backdrop">
      <div
        className="admin-pro-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
      >
        <div
          className={`admin-pro-confirm-icon ${
            state.danger ? "danger" : ""
          }`}
        >
          {state.danger ? "!" : "?"}
        </div>

        <h3 id="admin-confirm-title">{state.title}</h3>
        <p>{state.message}</p>

        <div className="admin-pro-confirm-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => finish(false)}
          >
            {state.cancelLabel}
          </button>

          <button
            type="button"
            className={state.danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => finish(true)}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return {
    confirm,
    modal,
  };
}
