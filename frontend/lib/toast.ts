import toast from "react-hot-toast";
import { localAnalytics } from "./analytics";

export const showToast = {
  success: (message: string) => {
    localAnalytics().logEvent("ToastShown", { type: "success", message });
    return toast.success(message);
  },

  error: (message: string) => {
    localAnalytics().logEvent("ToastShown", { type: "error", message });
    return toast.error(message);
  },

  loading: (message: string) => {
    localAnalytics().logEvent("ToastShown", { type: "loading", message });
    return toast.loading(message);
  },

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    localAnalytics().logEvent("ToastPromiseStarted", messages);
    return toast.promise(promise, messages);
  },

  custom: (message: string, options?: Record<string, unknown>) => {
    localAnalytics().logEvent("ToastShown", { type: "custom", message });
    return toast(message, options);
  },
};

export { toast };
export default toast;
