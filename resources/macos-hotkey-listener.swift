import Cocoa
import Foundation
import Darwin

// Configurable hotkey - defaults to backtick (keyCode 50)
// Can be passed as first argument: ./macos-hotkey-listener 50
var targetKeyCode: Int64 = 50 // backtick

if CommandLine.arguments.count > 1, let code = Int64(CommandLine.arguments[1]) {
    targetKeyCode = code
}

let mask = CGEventMask(1 << CGEventType.keyDown.rawValue) | CGEventMask(1 << CGEventType.keyUp.rawValue)
var eventTap: CFMachPort?

func eventTapCallback(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent, refcon: UnsafeMutableRawPointer?) -> Unmanaged<CGEvent>? {
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: true)
        }
        return Unmanaged.passUnretained(event)
    }

    let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
    let flags = event.flags

    // Check for modifier keys (Cmd, Shift, Ctrl, Option)
    let hasCommand = flags.contains(.maskCommand)
    let hasShift = flags.contains(.maskShift)
    let hasControl = flags.contains(.maskControl)
    let hasOption = flags.contains(.maskAlternate)
    let hasModifier = hasCommand || hasShift || hasControl || hasOption

    if keyCode == targetKeyCode {
        // If any modifier is held, pass the event through (for Cmd+` or Shift+` etc)
        if hasModifier {
            if type == .keyDown {
                if hasCommand {
                    FileHandle.standardOutput.write("CMD_KEY_DOWN\n".data(using: .utf8)!)
                } else if hasShift {
                    FileHandle.standardOutput.write("SHIFT_KEY_DOWN\n".data(using: .utf8)!)
                }
                fflush(stdout)
            }
            // Don't consume - let the system/Electron handle modified keypresses
            return Unmanaged.passUnretained(event)
        }

        // Plain key press (no modifiers) - this is our dictation toggle
        if type == .keyDown {
            FileHandle.standardOutput.write("KEY_DOWN\n".data(using: .utf8)!)
            fflush(stdout)
        } else if type == .keyUp {
            FileHandle.standardOutput.write("KEY_UP\n".data(using: .utf8)!)
            fflush(stdout)
        }
        // Return nil to consume the event (don't pass backtick to other apps)
        return nil
    }

    return Unmanaged.passUnretained(event)
}

guard let createdTap = CGEvent.tapCreate(tap: .cgSessionEventTap,
                                         place: .headInsertEventTap,
                                         options: .defaultTap,
                                         eventsOfInterest: mask,
                                         callback: eventTapCallback,
                                         userInfo: nil) else {
    FileHandle.standardError.write("Failed to create event tap. Check accessibility permissions.\n".data(using: .utf8)!)
    exit(1)
}

eventTap = createdTap

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, createdTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: createdTap, enable: true)

let signalSource = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
signal(SIGTERM, SIG_IGN)
signalSource.setEventHandler {
    CFRunLoopStop(CFRunLoopGetCurrent())
}
signalSource.resume()

CFRunLoopRun()
