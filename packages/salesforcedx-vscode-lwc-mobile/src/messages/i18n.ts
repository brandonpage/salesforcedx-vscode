/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If omitted, we will assume _message.
 */
export const messages = {
  force_lightning_lwc_mobile_text: 'SFDX: Preview Component Locally on Mobile',
  force_lightning_lwc_mobile_no_plugin:
    'To run this command, first install the @salesforce/lwc-dev-mobile plugin.',
  force_lightning_lwc_mobile_file_undefined:
    "Can't find the Lightning Web Components module. Check that %s is the correct file path.",
  force_lightning_lwc_mobile_file_nonexist:
    "Can't find the Lightning Web Components module in %s. Check that the module exists.",
  force_lightning_lwc_mobile_preview_unsupported:
    "Something's not right with the file path. The local development server doesn't recognize the Lightning Web Components module '%s.'",
  force_lightning_lwc_mobile_platform_selection:
    'Select the platform for previewing the component',
  force_lightning_lwc_mobile_android_target_default:
    'Enter the name for the Android emulator (leave blank for default)',
  force_lightning_lwc_mobile_ios_target_default:
    'Enter the name for the iOS simulator (leave blank for default)',
  force_lightning_lwc_mobile_android_target_remembered:
    "Enter the name for the Android emulator (leave blank for '%s')",
  force_lightning_lwc_mobile_ios_target_remembered:
    "Enter the name for the iOS simulator (leave blank for '%s')",
  force_lightning_lwc_mobile_cancelled: 'Preview platform selection cancelled.',
  force_lightning_lwc_mobile_android_device_cancelled:
    'Emulator selection cancelled.',
  force_lightning_lwc_mobile_ios_device_cancelled:
    'Simulator selection cancelled.',
  force_lightning_lwc_mobile_ios_label: 'Use iOS Simulator',
  force_lightning_lwc_mobile_ios_description: 'Preview component on iOS',
  force_lightning_lwc_mobile_android_label: 'Use Android Emulator',
  force_lightning_lwc_mobile_android_description:
    'Preview component on Android',
  force_lightning_lwc_mobile_android_failure:
    "Failed to start Android Emulator '%s'",
  force_lightning_lwc_mobile_ios_failure: "Failed to start iOS Simulator '%s'",
  force_lightning_lwc_mobile_android_start: "Starting Android Emulator '%s'",
  force_lightning_lwc_mobile_ios_start: "Starting iOS Simulator '%s'"
};
