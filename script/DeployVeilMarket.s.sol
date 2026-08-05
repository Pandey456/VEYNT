// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VeilMarket} from "../src/VeilMarket.sol";

contract DeployVeilMarket is Script {
    VeilMarket public veilMarket;

    function run() public {
        //address ftsoV2Address = 0x3D89fDcfe3A5e5B84774B39965b7fCeBdDBCfb76;
        address ftsoV2Address = 0x3d893C53D9e8056135C26C8c638B76C8b60Df726;
        bytes21 flrUsdFeedId = bytes21(
            0x01464c522f55534400000000000000000000000000
        );
        address teeSigner = 0x2a01228E21e6b6321EcF066EE155C2Af20e99c74;
        vm.startBroadcast();

        veilMarket = new VeilMarket(ftsoV2Address, flrUsdFeedId, teeSigner);

        vm.stopBroadcast();

        console2.log("==========================================");
        console2.log("VeilMarket deployed at:", address(veilMarket));
        console2.log("Authorized TEE Signer: ", teeSigner);
        console2.log("==========================================");
    }
}
