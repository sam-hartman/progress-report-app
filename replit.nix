{ pkgs, ... }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.python311Packages.uvicorn
    pkgs.python311Packages.fastapi
    pkgs.python311Packages.pillow
    pkgs.python311Packages.opencv4
    pkgs.python311Packages.numpy
    pkgs.python311Packages.pydantic
    pkgs.python311Packages.pydantic-settings
    pkgs.python311Packages.python-multipart
    pkgs.python311Packages.httpx
    pkgs.python311Packages.python-dotenv
    pkgs.tesseract
    pkgs.tesseract-ocr
    pkgs.tesseract-ocr-eng
    pkgs.nodejs-18_x
  ];

  env = {
    PYTHONPATH = ".";
    MISTRAL_API_KEY = "";
    DEBUG = "true";
    PORT = "8000";
  };
}
