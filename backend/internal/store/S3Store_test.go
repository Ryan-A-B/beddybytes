package store_test

import (
	"context"
	"testing"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/ryan/baby-monitor/backend/internal"
	"github.com/ryan/baby-monitor/backend/internal/store"
)

func TestS3Store(t *testing.T) {
	t.Skip("Skipping S3Store tests")
	Convey("TestS3Store", t, func() {
		config, err := awsconfig.LoadDefaultConfig(context.Background())
		So(err, ShouldBeNil)
		s := store.NewS3Store(&store.NewS3StoreInput{
			Client: s3.NewFromConfig(config),
			Bucket: internal.EnvStringOrFatal("TESTING_S3_BUCKET"),
			Prefix: "testing/",
		})
		testStore(t, s)
	})
}
