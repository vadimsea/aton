cmake_minimum_required(VERSION 3.24)

file(READ "${CMAKE_CURRENT_SOURCE_DIR}/VERSION" ATEN_VERSION)
string(STRIP "${ATEN_VERSION}" ATEN_VERSION)
if(NOT ATEN_VERSION MATCHES "^[0-9]+\\.[0-9]+\\.[0-9]+$")
  message(FATAL_ERROR "desktop-qt/VERSION must use the MAJOR.MINOR.PATCH format")
endif()

project(AtenDesktop
  VERSION ${ATEN_VERSION}
  DESCRIPTION "ATEN desktop messenger client"
  LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Qt6 6.5 REQUIRED COMPONENTS
  Core
  Gui
  Multimedia
  Network
  Widgets
)

qt_standard_project_setup()

configure_file(
  resources/AppVersion.h.in
  "${CMAKE_CURRENT_BINARY_DIR}/generated/AppVersion.h"
  @ONLY
)

string(REPLACE "." "," ATEN_VERSION_COMMA "${PROJECT_VERSION}")
set(ATEN_VERSION_COMMA "${ATEN_VERSION_COMMA},0")
file(TO_CMAKE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/resources/aten-logo.ico" ATEN_ICON_RC_PATH)
configure_file(
  resources/aten-desktop.rc.in
  "${CMAKE_CURRENT_BINARY_DIR}/generated/aten-desktop.rc"
  @ONLY
)

qt_add_executable(aten-desktop
  WIN32
  src/main.cpp
  src/app/Application.cpp
  src/app/Application.h
  src/app/AppConfig.cpp
  src/app/AppConfig.h
  src/net/ApiClient.cpp
  src/net/ApiClient.h
  src/session/SessionStore.cpp
  src/session/SessionStore.h
  src/platform/TaskbarBadge.cpp
  src/platform/TaskbarBadge.h
  src/ui/NotificationHub.cpp
  src/ui/NotificationHub.h
  src/ui/MainWindow.cpp
  src/ui/MainWindow.h
  src/ui/Theme.cpp
  src/ui/Theme.h
)

target_include_directories(aten-desktop PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src
  ${CMAKE_CURRENT_BINARY_DIR}/generated
)

target_link_libraries(aten-desktop PRIVATE
  Qt6::Core
  Qt6::Gui
  Qt6::Multimedia
  Qt6::Network
  Qt6::Widgets
)

set_target_properties(aten-desktop PROPERTIES
  OUTPUT_NAME "ATEN"
)

if(WIN32)
  target_sources(aten-desktop PRIVATE "${CMAKE_CURRENT_BINARY_DIR}/generated/aten-desktop.rc")
  target_link_libraries(aten-desktop PRIVATE user32)

  add_executable(aten-overlay-helper tools/aten-overlay-helper.cpp)
  target_link_libraries(aten-overlay-helper PRIVATE ole32 user32 gdi32 gdiplus)
  set_target_properties(aten-overlay-helper PROPERTIES
    OUTPUT_NAME "aten-overlay-helper"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
  )
  add_dependencies(aten-desktop aten-overlay-helper)
  add_custom_command(TARGET aten-desktop POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      "$<TARGET_FILE:aten-overlay-helper>"
      "$<TARGET_FILE_DIR:aten-desktop>/aten-overlay-helper.exe"
    COMMENT "Copy aten-overlay-helper.exe next to ATEN.exe"
  )
endif()

install(TARGETS aten-desktop
  BUNDLE DESTINATION .
  RUNTIME DESTINATION .
)
