# OTINER برای macOS

نسخهٔ مک مخصوص **Premiere Pro 2024 / 24.x** است. همراه میان‌بر یک باینری Universal شامل Intel `x86_64` و Apple Silicon `arm64` است. حداقل هدف ساخت macOS 12 است؛ خود پریمیر هم باید روی نسخهٔ macOS و سخت‌افزار شما قابل اجرا باشد.

## نصب از بستهٔ آماده

۱. فایل **OTINER-1.2.0-macOS-Universal.zip** را از [Releases](https://github.com/adib-rahamani-dev/SoundPrime/releases) بگیرید و با Archive Utility کامل Extract کنید.

۲. پریمیر را کامل Quit کنید. داخل پوشهٔ **OTINER**، فایل **Install.command** را باز کنید. نصب فقط برای کاربر جاری و بدون sudo انجام می‌شود؛ برای بستهٔ آماده نیازی به Xcode، Node یا Rosetta نیست.

۳. پریمیر ۲۰۲۴ را باز کنید: **Window → Extensions → OTINER**. پنل باید باز بماند.

بسته امضای Developer ID و notarization اپل ندارد؛ همراه فقط امضای ad-hoc دارد. اگر macOS مانع اجرا شد، فقط در صورت اعتماد به همین مخزن، فایل و پیام آن را بررسی و از روش رسمی macOS برای اجازهٔ اجرا استفاده کنید. نصب‌کننده Gatekeeper را خاموش یا quarantine را حذف نمی‌کند. [راهنمای رسمی اپل](https://support.apple.com/en-us/102445)

اگر فایل command مجوز اجرا ندارد، آن را از ZIP مک دوباره با Archive Utility استخراج کنید. برای اجرای نسخهٔ سورس می‌توانید در Terminal دستور `bash ` را بنویسید، فایل Install.command را به پنجره بکشید و Return بزنید؛ این مسیر برای سورسِ بدون باینری به Xcode Command Line Tools نیاز دارد. بستهٔ آماده شامل باینری است.

## میان‌برهای مک

- پیش‌فرض: **Cmd+Shift+1 تا Cmd+Shift+9**.
- تغییر: سه‌نقطهٔ پد → کادر میان‌بر → Cmd یا Control همراه حرف انگلیسی، عدد ردیف بالا یا F1…F12. Option و Shift هم می‌توانند به ترکیب اضافه شوند.
- همراه فقط وقتی پریمیر برنامهٔ فعال است کلیدها را نگه می‌دارد و با عوض شدن برنامه آزادشان می‌کند. از Carbon RegisterEventHotKey استفاده می‌کند؛ درخواست Accessibility، Input Monitoring یا ضبط کلیدها ندارد.
- بعضی کلیدهای رزروشده یا اشغال‌شدهٔ سیستم ثبت نمی‌شوند؛ پیام «ثبت میان‌بر ناموفق» نشان داده می‌شود. دلیل فنی در `errors.tsv` پوشهٔ موقت همان نشست است. ثبت موفق به معنی نبودن فرمان داخلی پریمیر نیست.
- برای بررسی پریمیر، **فایل KYS فعال مک خودتان** را انتخاب کنید. پلتفرم فایل باید `macintosh` باشد؛ `modifier.command`، `modifier.opt`، `modifier.ctrl` و `modifier.shift` خوانده می‌شوند. معمولاً فایل در `~/Documents/Adobe/Premiere Pro/24.0/Profile-…/Mac/` است. از منوی Premiere Pro → Keyboard Shortcuts یک preset ذخیره کنید و همان فایل را وارد پنل کنید. پس از تغییر preset، دوباره فایل را وارد کنید.
- کلیدهای عملکردی روی بعضی کیبوردها به Fn نیاز دارند. کلیدهای رزروشده را تغییر دهید؛ پشتیبانی تحویل واقعی میان‌بر در هر محیط پریمیر باید روی همان مک تأیید شود.

## ذخیره و حذف

- محل پنل: `~/Library/Application Support/Adobe/CEP/extensions/ir.oteener.soundprime`
- بانک: `~/Library/Application Support/OTINER/bank.json`؛ نسخهٔ قبلی: `bank.json.bak`
- نصب مجدد نسخهٔ قبلی پنل را در `~/Library/Application Support/OTINER/backups/` نگه می‌دارد.
- برای حذف: پریمیر را ببندید و **Uninstall.command** را باز کنید. بانک و صداها حفظ می‌شوند.

این پنل CEP بدون امضای تجاری است. نصب‌کننده `PlayerDebugMode=1` را فقط برای `com.adobe.CSXS.11` کاربر جاری فعال می‌کند. این تنظیم به افزونه‌های بدون امضای همان runtime نیز اجازهٔ بارگذاری می‌دهد. مقدار قبلی و نوع آن حفظ می‌شود و حذف‌کننده، اگر مقدار هنوز همان مقدار نصب‌شده باشد، آن را برمی‌گرداند.

بانک JSON بین مک و ویندوز قابل جابه‌جایی است، اما **مسیر فایل‌های صوتی باید دوباره روی مک انتخاب شود**. Cmd در ویندوز وجود ندارد؛ برای بانک ساخته‌شده در مک، پیش از وارد کردن در ویندوز میان‌برهای Cmd را حذف یا به Ctrl تغییر دهید. فایل KYS هر سیستم جداست.

## ساخت از سورس و محدودهٔ تست

روی مک با Xcode Command Line Tools و Node.js 18+: `npm ci`، سپس `npm test` و `npm run build:mac`.

CI مک دو معماری را کامپایل، امضای محلی را بررسی و تست نگاشت کلید، پروتکل همراه و انقضای heartbeat را اجرا می‌کند. نصب/حذف با HOME موقت و شبیه‌ساز تنظیمات تست می‌شوند تا تنظیمات واقعی کاربر runner تغییر نکنند. **درج صدا و تحویل واقعی میان‌بر در خود پریمیر روی مک فیزیکی هنوز تأیید نشده‌اند.**

مراجع: [راهنمای Adobe CEP 11](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_11.x/Documentation/CEP%2011.1%20HTML%20Extension%20Cookbook.md)، [الزامات Premiere 24.x](https://helpx.adobe.com/in/premiere/desktop/get-started/technical-requirements/adobe-premiere-24x-technical-requirements.html)، [مسیر فایل KYS در مک](https://helpx.adobe.com/premiere/desktop/get-started/keyboard-shortcuts/copy-keyboard-shortcuts-from-one-computer-to-another.html).
