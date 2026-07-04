Pod::Spec.new do |s|
  s.name           = 'SubjectLift'
  s.version        = '1.0.0'
  s.summary        = 'On-device subject lifting (die-cut sticker) via VisionKit.'
  s.description    = 'Lifts a photo subject with VNGenerateForegroundInstanceMaskRequest and bakes a white die-cut outline into a transparent PNG.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
