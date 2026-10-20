#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>

// Local Carbon hotkeys; no event tap, Accessibility access, network or login item.
static int MacKey(int key) {
    static const int letters[26] = {0,11,8,2,14,3,5,4,34,38,40,37,46,45,31,35,12,15,1,17,32,9,13,7,16,6};
    static const int digits[10] = {29,18,19,20,21,23,22,26,28,25};
    static const int functions[12] = {122,120,99,118,96,97,98,100,101,109,103,111};
    if (key >= 65 && key <= 90) return letters[key - 65];
    if (key >= 48 && key <= 57) return digits[key - 48];
    if (key >= 112 && key <= 123) return functions[key - 112];
    return -1;
}
static UInt32 MacModifiers(int modifiers) {
    return ((modifiers & 8) ? cmdKey : 0) | ((modifiers & 2) ? controlKey : 0) |
           ((modifiers & 1) ? optionKey : 0) | ((modifiers & 4) ? shiftKey : 0);
}
@interface OTINERHotkeys : NSObject
@property(nonatomic, copy) NSString *folder;
@property(nonatomic, copy) NSString *lastConfig;
@property(nonatomic, copy) NSString *lastStatus;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSArray<NSNumber *> *> *keys;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSValue *> *registered;
@property(nonatomic, strong) NSMutableSet<NSNumber *> *pressed;
@property(nonatomic, strong) NSDate *lastProbe;
@property(nonatomic) BOOL active;
- (void)tick:(NSTimer *)timer;
- (void)releaseKeys;
- (BOOL)premiereFocused;
- (void)key:(UInt32)slot pressed:(BOOL)pressed;
@end
@implementation OTINERHotkeys
- (instancetype)init {
    if ((self = [super init])) {
        _keys = [NSMutableDictionary dictionary]; _registered = [NSMutableDictionary dictionary];
        _pressed = [NSMutableSet set]; _lastProbe = [NSDate distantPast];
    }
    return self;
}
- (NSString *)file:(NSString *)name { return [self.folder stringByAppendingPathComponent:name]; }
- (BOOL)premiereFocused {
    NSString *bundle = NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier;
    return [bundle isEqualToString:@"com.adobe.PremierePro"] || [bundle hasPrefix:@"com.adobe.PremierePro."];
}
- (void)releaseKeys {
    for (NSValue *value in self.registered.allValues) UnregisterEventHotKey((EventHotKeyRef)value.pointerValue);
    [self.registered removeAllObjects]; [self.pressed removeAllObjects];
}
- (void)tick:(NSTimer *)timer {
    NSFileManager *fm = NSFileManager.defaultManager;
    NSDate *beat = [fm attributesOfItemAtPath:[self file:@"heartbeat"] error:NULL][NSFileModificationDate];
    if (!beat || -beat.timeIntervalSinceNow > 15) { [self releaseKeys]; [NSApp terminate:nil]; return; }
    if ([fm fileExistsAtPath:[self file:@"paused"]]) { [self releaseKeys]; self.active = NO; return; }
    NSString *config = [NSString stringWithContentsOfFile:[self file:@"keys.tsv"] encoding:NSUTF8StringEncoding error:NULL];
    if (!config) return;
    BOOL focused = [self premiereFocused];
    BOOL changed = ![config isEqualToString:self.lastConfig] || focused != self.active;
    if (changed) {
        [self releaseKeys]; [self.keys removeAllObjects];
        for (NSString *line in [config componentsSeparatedByString:@"\n"]) {
            NSArray *parts = [line componentsSeparatedByString:@"\t"];
            if (parts.count != 3) continue;
            int numbers[3] = {0}; BOOL valid = YES;
            for (int n=0; n<3; n++) {
                NSScanner *scanner = [NSScanner scannerWithString:parts[n]];
                if (![scanner scanInt:&numbers[n]] || !scanner.isAtEnd) { valid = NO; break; }
            }
            int slot=numbers[0], modifiers=numbers[1], key=numbers[2];
            if (valid && slot >= 0 && slot < 9 && modifiers > 0 && modifiers <= 15 && (modifiers & 10) && MacKey(key) >= 0)
                self.keys[@(slot)] = @[@(modifiers), @(key)];
        }
        self.lastConfig = config; self.active = focused;
    }
    if (!changed && -self.lastProbe.timeIntervalSinceNow < 2) return;
    self.lastProbe = [NSDate date];
    NSMutableArray *statuses = [NSMutableArray array];
    NSMutableArray *errors = [NSMutableArray array];
    for (NSNumber *slot in [[self.keys allKeys] sortedArrayUsingSelector:@selector(compare:)]) {
        BOOL ok = self.registered[slot] != nil;
        OSStatus status = noErr;
        if (!ok) {
            NSArray *binding = self.keys[slot]; EventHotKeyRef ref = NULL;
            EventHotKeyID identifier = { 'OTNR', slot.unsignedIntValue };
            status = RegisterEventHotKey(MacKey([binding[1] intValue]), MacModifiers([binding[0] intValue]), identifier,
                                        GetApplicationEventTarget(), 0, &ref);
            ok = status == noErr && ref != NULL;
            if (ok) {
                if (focused) self.registered[slot] = [NSValue valueWithPointer:ref];
                else UnregisterEventHotKey(ref);
            }
        }
        // macOS can refuse a key because it is reserved, in use, or not available in this session.
        [statuses addObject:[NSString stringWithFormat:@"%@\t%@", slot, ok ? (focused ? @"active" : @"available") : @"unavailable"]];
        if (!ok) [errors addObject:[NSString stringWithFormat:@"%@\t%d", slot, (int)status]];
    }
    NSString *output = [statuses componentsJoinedByString:@"\n"];
    if (![output isEqualToString:self.lastStatus] || ![fm fileExistsAtPath:[self file:@"status.tsv"]]) {
        [output writeToFile:[self file:@"status.tsv"] atomically:YES encoding:NSUTF8StringEncoding error:NULL];
        [[errors componentsJoinedByString:@"\n"] writeToFile:[self file:@"errors.tsv"] atomically:YES encoding:NSUTF8StringEncoding error:NULL];
        self.lastStatus = output;
    }
}
- (void)key:(UInt32)slot pressed:(BOOL)pressed {
    if (slot > 8) return;
    NSNumber *identifier = @(slot);
    if (!pressed) { [self.pressed removeObject:identifier]; return; }
    if ([self.pressed containsObject:identifier]) return;
    [self.pressed addObject:identifier];
    if (!self.active || ![self premiereFocused] || [NSFileManager.defaultManager fileExistsAtPath:[self file:@"paused"]]) return;
    NSString *name = [NSString stringWithFormat:@"event-%020llu-%@.txt", (unsigned long long)(NSDate.date.timeIntervalSince1970 * 1000000), NSUUID.UUID.UUIDString];
    [identifier.stringValue writeToFile:[self file:name] atomically:YES encoding:NSUTF8StringEncoding error:NULL];
}
@end
static OSStatus HandleHotkey(EventHandlerCallRef next, EventRef event, void *data) {
    EventHotKeyID identifier;
    if (GetEventParameter(event, kEventParamDirectObject, typeEventHotKeyID, NULL, sizeof(identifier), NULL, &identifier) != noErr || identifier.signature != 'OTNR') return eventNotHandledErr;
    [(__bridge OTINERHotkeys *)data key:identifier.id pressed:GetEventKind(event) == kEventHotKeyPressed];
    return noErr;
}
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc == 2 && strcmp(argv[1], "--self-test") == 0) {
            if (MacKey(65) != kVK_ANSI_A || MacKey(49) != kVK_ANSI_1 || MacKey(123) != kVK_F12 || MacKey(999) != -1 || MacModifiers(12) != (cmdKey | shiftKey)) return 1;
            puts("Mac native key translation passed."); return 0;
        }
        if (argc != 2) return 1;
        OTINERHotkeys *host = [OTINERHotkeys new]; host.folder = [NSString stringWithUTF8String:argv[1]];
        BOOL directory = NO;
        if (![NSFileManager.defaultManager fileExistsAtPath:host.folder isDirectory:&directory] || !directory) return 1;
        [NSApplication sharedApplication]; [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];
        EventTypeSpec events[] = {{kEventClassKeyboard, kEventHotKeyPressed}, {kEventClassKeyboard, kEventHotKeyReleased}};
        EventHandlerRef handler = NULL;
        OSStatus status = InstallApplicationEventHandler(HandleHotkey, 2, events, (__bridge void *)host, &handler);
        if (status != noErr) return 1;
        NSTimer *timer = [NSTimer scheduledTimerWithTimeInterval:0.1 target:host selector:@selector(tick:) userInfo:nil repeats:YES];
        [host tick:timer]; [NSApp run]; [timer invalidate]; [host releaseKeys]; RemoveEventHandler(handler);
    }
    return 0;
}
