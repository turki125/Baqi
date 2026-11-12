export function photoErrorMessage(status: number, tr: (en: string, ar: string) => string) {
  if (status === 401) return tr('Sign in again to use photo assistance.', 'سجّل الدخول مجدداً لاستخدام المساعدة بالصور.');
  if (status === 403 || status === 404) return tr('Upload this photo again from your account, then retry.', 'أعد رفع هذه الصورة من حسابك ثم حاول مجدداً.');
  if (status === 413) return tr('Choose a photo no larger than 10 MB.', 'اختر صورة بحجم لا يتجاوز 10 ميغابايت.');
  if (status === 415) return tr('This file could not be read. Choose a valid JPEG, PNG or WebP photo.', 'تعذرت قراءة الملف. اختر صورة JPEG أو PNG أو WebP صالحة.');
  if (status === 422) return tr('The material is unclear. Try a closer photo with good lighting.', 'المادة غير واضحة. جرّب صورة أقرب بإضاءة جيدة.');
  if (status === 429) return tr('Photo assistance is busy or the request limit was reached. Wait a minute before retrying.', 'المساعدة بالصور مشغولة أو تم بلوغ حد الطلبات. انتظر دقيقة قبل المحاولة.');
  return tr('Photo assistance could not finish. Try again, or use manual entry and text search.', 'تعذرت المساعدة بالصور. حاول مجدداً أو استخدم الإدخال اليدوي والبحث النصي.');
}
