CXX = g++
# Target and dependencies 
TARGET = curie 
SRCS = main.cpp braveDebug.cpp dataSource.cpp thermalCamera.cpp
OBJS = $(subst .cpp,.o,$(SRCS))

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CXX) -o $(TARGET) $(OBJS)

main.o: main.cpp
dataSource.o: dataSource.cpp
thermalCamera.o: thermalCamera.cpp
braveDebug.o: braveDebug.cpp

# Cleanup 
clean:
	rm $(OBJS)
