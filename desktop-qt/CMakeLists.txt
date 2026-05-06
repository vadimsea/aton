cmake_minimum_required(VERSION 3.24)

project(AtenDesktop
  VERSION 0.1.0
  DESCRIPTION "ATEN desktop messenger client"
  LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Qt6 6.5 REQUIRED COMPONENTS
  Core
  Gui
  Network
  Widgets
)

qt_standard_project_setup()

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
  src/ui/MainWindow.cpp
  src/ui/MainWindow.h
  src/ui/Theme.cpp
  src/ui/Theme.h
)

target_include_directories(aten-desktop PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(aten-desktop PRIVATE
  Qt6::Core
  Qt6::Gui
  Qt6::Network
  Qt6::Widgets
)

set_target_properties(aten-desktop PROPERTIES
  OUTPUT_NAME "ATEN"
)

install(TARGETS aten-desktop
  BUNDLE DESTINATION .
  RUNTIME DESTINATION .
)
