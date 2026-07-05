Pod::Spec.new do |s|
  s.name           = 'ProgressiveBlur'
  s.version        = '1.0.0'
  s.summary        = 'iOS progressive/variable blur band for transparent headers.'
  s.description    = 'A native view that applies a top-to-bottom gradient variable blur behind transparent navigation headers.'
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
