CXX = g++
# Target and dependencies 
TARGET = curie 
SRCS = main.cpp braveDebug.cpp dataSource.cpp thermalCamera.cpp i2cInterface.cpp postgresInterface.cpp
OBJS = $(subst .cpp,.o,$(SRCS))
LIBDIR = -L/usr/lib/aarch64-linux-gnu/
LIBS = -lpqxx -lpq

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) -o $(TARGET) $(OBJS) $(LIBS)

main.o: main.cpp
dataSource.o: dataSource.cpp
i2cInterface.o: i2cInterface.cpp
thermalCamera.o: thermalCamera.cpp
braveDebug.o: braveDebug.cpp
postgresInterface.o: postgresInterface.cpp

# Cleanup 
clean:
	rm $(OBJS)
