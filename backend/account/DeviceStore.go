package account

import (
	"context"
	"net/http"
	"sort"

	"github.com/ansel1/merry"
)

type Device struct {
	DeviceID string
	Name     string
	Tags     Tags
}

type ListInput struct {
	Tags []Tag `json:"tag"`
}

func (input *ListInput) Validate() (err error) {
	for _, tag := range input.Tags {
		err = tag.Validate()
		if err != nil {
			return
		}
	}
	return
}

type DeviceStore interface {
	Put(ctx context.Context, device *Device) (err error)
	List(ctx context.Context, input ListInput) (devices []*Device, err error)
	Get(ctx context.Context, deviceID string) (device *Device, err error)
	Remove(ctx context.Context, deviceID string) (err error)
}

type DeviceStoreInMemory struct {
	devices map[string][]*Device
}

func NewDeviceStoreInMemory() (deviceStore *DeviceStoreInMemory) {
	deviceStore = &DeviceStoreInMemory{
		devices: make(map[string][]*Device),
	}
	return
}

func (deviceStore *DeviceStoreInMemory) Put(ctx context.Context, device *Device) (err error) {
	accountID := GetAccountIDFromContext(ctx)
	devices, ok := deviceStore.devices[accountID]
	if !ok {
		devices = make([]*Device, 0)
	}
	index, ok := search(devices, device.DeviceID)
	if ok {
		devices[index] = device
		return
	}
	devices = append(devices, nil)
	copy(devices[index+1:], devices[index:])
	devices[index] = device
	deviceStore.devices[accountID] = devices
	return
}

func (deviceStore *DeviceStoreInMemory) List(ctx context.Context, input ListInput) (filteredDevices []*Device, err error) {
	accountID := GetAccountIDFromContext(ctx)
	devices, ok := deviceStore.devices[accountID]
	if !ok {
		filteredDevices = make([]*Device, 0)
		return
	}
	if len(input.Tags) == 0 {
		filteredDevices = devices
		return
	}
	filteredDevices = make([]*Device, 0, len(devices))
	for _, device := range devices {
		for _, tag := range input.Tags {
			if device.Tags.Contains(tag) {
				filteredDevices = append(filteredDevices, device)
				break
			}
		}
	}
	return
}

func (deviceStore *DeviceStoreInMemory) Get(ctx context.Context, deviceID string) (device *Device, err error) {
	accountID := GetAccountIDFromContext(ctx)
	devices, ok := deviceStore.devices[accountID]
	if !ok {
		err = merry.New("device not found").WithHTTPCode(http.StatusNotFound)
		return
	}
	index, ok := search(devices, deviceID)
	if ok {
		device = devices[index]
		return
	}
	err = merry.New("device not found").WithHTTPCode(http.StatusNotFound)
	return
}

func (deviceStore *DeviceStoreInMemory) Remove(ctx context.Context, deviceID string) (err error) {
	accountID := GetAccountIDFromContext(ctx)
	devices, ok := deviceStore.devices[accountID]
	if !ok {
		return
	}
	index, ok := search(devices, deviceID)
	if ok {
		devices = append(devices[:index], devices[index+1:]...)
		deviceStore.devices[accountID] = devices
	}
	return
}

func search(devices []*Device, deviceID string) (index int, ok bool) {
	index = sort.Search(len(devices), func(i int) bool {
		return deviceID < devices[i].DeviceID
	})
	ok = index < len(devices) && devices[index].DeviceID == deviceID
	return
}
