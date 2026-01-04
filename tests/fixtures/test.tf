
resource "aws_instance" "test-server" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"
  
  tags = {
    Environment = "test"
    Owner       = "devops"
    Project     = "testing"
  }
}

resource "aws_s3_bucket" "test-bucket" {
  bucket = "test-bucket"
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
  
  tags = {
    Environment = "test"
    Owner       = "devops"
    Project     = "testing"
  }
}
