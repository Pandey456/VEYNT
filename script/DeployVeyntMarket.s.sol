// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VeyntMarket} from "../src/VeyntMarket.sol";

contract DeployVeyntMarket is Script {
    VeyntMarket public veyntMarket;

    function run() public {
        // Authorized TEE signer
        address teeSigner = 0x2a01228E21e6b6321EcF066EE155C2Af20e99c74;

        vm.startBroadcast();

        veyntMarket = new VeyntMarket(teeSigner);

        vm.stopBroadcast();

        console2.log("==========================================");
        console2.log("VEYNT MARKET DEPLOYED");
        console2.log("==========================================");
        console2.log("VeyntMarket deployed at:", address(veyntMarket));
        console2.log("Authorized TEE Signer:", teeSigner);
        console2.log("Market Creation Fee: 1 BOT");
        console2.log("==========================================");
    }
}
