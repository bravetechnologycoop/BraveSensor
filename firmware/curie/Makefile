CXX      := -c++
#CXXFLAGS := -pedantic-errors -Wall -Wextra -Werror
CXXFLAGS := -Wall -D_LINUX_
LDFLAGS  := -L/usr/lib -L/usr/lib/aarch64-linux-gnu/ -lstdc++ -lm -lpqxx -lpq -lgpiod -lpigpio -li2c
BUILD    := ./build
OBJ_DIR  := $(BUILD)/objects
BIN_DIR  := $(BUILD)/bin
TARGET   := curie
INCLUDE  := -Iinclude/
SRC      :=						\
	$(wildcard src/SEN55/*.cpp)	\
	$(wildcard src/*.cpp)		\
	$(wildcard src/vl53l5cx/*.cpp)		\
	$(wildcard src/MLX90640/*.cpp)		\
	$(wildcard src/vl53l1x/*.cpp)		\

OBJECTS  := $(SRC:%.cpp=$(OBJ_DIR)/%.o)#/$(SRC:%.c=$(OBJ_DIR)/%.o)
DEPENDENCIES \
         := $(OBJECTS:.o=.d)

all: build $(BIN_DIR)/$(TARGET)

$(OBJ_DIR)/%.o: %.cpp
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) $(INCLUDE) -c $< -MMD -o $@

#$(OBJ_DIR)/%.o: %.c
#	@mkdir -p $(@D)
#	$(CXX) $(CXXFLAGS) $(INCLUDE) -c $< -MMD -o $@

$(BIN_DIR)/$(TARGET): $(OBJECTS)
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) -o $(BIN_DIR)/$(TARGET) $^ $(LDFLAGS)

-include $(DEPENDENCIES)

.PHONY: all build clean debug release info

build:
	@mkdir -p $(BIN_DIR)
	@mkdir -p $(OBJ_DIR)

debug: CXXFLAGS += -DDEBUG -g
debug: all

release: CXXFLAGS += -O2
release: all

clean:
	-@rm -rvf $(OBJ_DIR)/*
	-@rm -rvf $(BIN_DIR)/*

info:
	@echo "[*] Application dir: ${BIN_DIR}     "
	@echo "[*] Object dir:      ${OBJ_DIR}     "
	@echo "[*] Sources:         ${SRC}         "
	@echo "[*] Objects:         ${OBJECTS}     "
	@echo "[*] Dependencies:    ${DEPENDENCIES}"
