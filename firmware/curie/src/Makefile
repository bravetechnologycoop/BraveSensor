CXX = g++
# Target and dependencies 
TARGET = curie 
SRCS = main.cpp braveDebug.cpp dataSource.cpp thermalCamera.cpp i2cInterface.cpp postgresInterface.cpp
OBJS = $(subst .cpp,.o,$(SRCS))
LIBS = -lpqxx

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) $(LIBS) -o $(TARGET) $(OBJS)

main.o: main.cpp
dataSource.o: dataSource.cpp
i2cInterface.o: i2cInterface.cpp
thermalCamera.o: thermalCamera.cpp
braveDebug.o: braveDebug.cpp
postgresInterface.o: postgresInterface.cpp

# Cleanup 
clean:
	rm $(OBJS)
