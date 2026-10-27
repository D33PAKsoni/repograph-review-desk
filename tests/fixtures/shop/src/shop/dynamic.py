import importlib


def load_service(name: str):
    return importlib.import_module("shop.services." + name)
