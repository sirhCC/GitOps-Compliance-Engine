# Example Terraform file for testing validation

resource "aws_instance" "web_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.xlarge"  # Should trigger cost warning

  tags = {
    Name = "WebServer"
    # Missing: Environment, Owner, Project (should trigger tagging warning)
  }
}

resource "aws_s3_bucket" "PublicBucket" {  # Should trigger naming convention info
  bucket = "my-public-bucket"
}

resource "aws_db_instance" "database" {
  allocated_storage    = 20
  engine               = "mysql"
  instance_class       = "db.t3.micro"
  publicly_accessible  = true  # Should trigger security error

  tags = {
    Environment = "production"
    Owner       = "platform-team"
    Project     = "main-app"
  }
}

resource "aws_lambda_function" "api" {
  function_name = "api-handler"
  role          = "arn:aws:iam::123456789:role/lambda-role"
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  tags = {
    Environment = "production"
    Owner       = "backend-team"
    Project     = "api-service"
  }
}
